import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import LocaleLink from './LocaleLink';
import ExtraBlocks from '../cms/ExtraBlocks';
import { useCurrentYear } from '../../lib/currentContest';
import type { HomeContent } from '../../../supabase/functions/_shared/cms/schemas/home';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';

type SeoCopy = HomeContent['seo'];
type CardKey = keyof SeoCopy['cards'];

/** Line icons from the home board (24px grid, stroke 2). */
const ICONS: Record<string, ReactNode> = {
  mic: <path d="M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  list: <path d="M4 6h16M4 12h10M4 18h7" />,
  quiz: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01" /></>,
  bars: <path d="M7 21V11M12 21V4M17 21v-6" />,
  party: <path d="M5 21l4-12 8 8-12 4zM14 4l1 2M19 9l2-1M17 3l-1 3M20 6l-3 1" />,
  play: <><rect x="3" y="6" width="18" height="12" rx="4" /><path d="M8 10v4M6 12h4M15.5 11h.01M17.5 13h.01" /></>,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13" />,
};

interface CardDef {
  href: string;
  icon: keyof typeof ICONS;
  /** CMS card copy, or the i18n keys for cards the CMS doc does not carry. */
  titleKey?: CardKey;
  descKey?: CardKey;
  i18n?: { title: string; desc: string };
}

const PRIMARY_CARDS: CardDef[] = [
  { href: '/eurovision-night', titleKey: 'nightTitle', descKey: 'nightDesc', icon: 'mic' },
  { href: '/eurovision-predictions', titleKey: 'predictionsTitle', descKey: 'predictionsDesc', icon: 'list' },
  { href: '/eurovision-trivia', titleKey: 'triviaTitle', descKey: 'triviaDesc', icon: 'quiz' },
  { href: '/winners', i18n: { title: 'home.guides.winnersTitle', desc: 'home.guides.winnersDesc' }, icon: 'bars' },
];

const SECONDARY_CARDS: CardDef[] = [
  { href: '/eurovision-party', titleKey: 'partyTitle', descKey: 'partyDesc', icon: 'party' },
  { href: '/eurovision-games', titleKey: 'gamesTitle', descKey: 'gamesDesc', icon: 'play' },
  { href: '/how-to-play', titleKey: 'howTitle', descKey: 'howDesc', icon: 'book' },
];

function Card({ card, cards }: { card: CardDef; cards: SeoCopy['cards'] }) {
  const { t } = useTranslation();
  const title = card.titleKey ? cards[card.titleKey] : t(card.i18n!.title);
  const desc = card.descKey ? cards[card.descKey] : t(card.i18n!.desc);
  return (
    <LocaleLink to={card.href} className="card-link home-guide">
      <span className="ico">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[card.icon]}
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="home-guide-title">{title}</h3>
        <p className="t-small m-0">{desc}</p>
      </div>
      <svg className="home-guide-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </LocaleLink>
  );
}

// "Plan the night" block of the home page (home board: "Οργάνωσε τη βραδιά"
// on mobile, the "Οδηγοί" two-column section on desktop). It carries the
// page's H1 and lede, the CMS doc's `seo` copy (content/pages/home.json),
// passed in by HomePage; the H1 text is SEO-frozen.
export default function HomeSeoBlock({ copy: c, extraBlocks }: { copy: SeoCopy; extraBlocks?: unknown }) {
  const { t } = useTranslation();
  const year = useCurrentYear();

  return (
    <section className="wrap home-guides" aria-labelledby="home-h1">
      <header className="home-guides-intro">
        <span className="t-eyebrow hidden lg:block">{t('home.guides.eyebrow')}</span>
        <h1 id="home-h1" className="home-guides-h1">{c.headline}</h1>
        <p className="t-body">
          <strong className="text-stage-text font-semibold">{c.leadStrong}</strong>
          {interpolate(c.leadRest, { year })}
        </p>
      </header>

      {/* Soft CTA: under the intro on desktop (grid), after the cards on mobile. */}
      <p className="t-small m-0 home-guides-tail">
        {c.tail}{' '}
        <LocaleLink to="/how-to-play" className="text-stage-pink-2 underline underline-offset-2 hover:text-stage-text">
          {c.tailLink}
        </LocaleLink>
        .
      </p>

      <div className="home-guides-lists">
        <div className="home-guides-group">
          <h2 className="t-eyebrow home-guides-h2">{c.primaryHeading}</h2>
          <div className="home-guides-grid">
            {PRIMARY_CARDS.map((card) => <Card key={card.href} card={card} cards={c.cards} />)}
          </div>
        </div>
        <div className="home-guides-group">
          <h2 className="t-eyebrow home-guides-h2">{c.secondaryHeading}</h2>
          <div className="home-guides-grid">
            {SECONDARY_CARDS.map((card) => <Card key={card.href} card={card} cards={c.cards} />)}
          </div>
        </div>
      </div>

      <div className="home-guides-extra stage-prose">
        <ExtraBlocks value={extraBlocks} />
      </div>

    </section>
  );
}
