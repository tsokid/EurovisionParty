import LocaleLink from './LocaleLink';
import { useCurrentYear } from '../../lib/currentContest';
import type { HomeContent } from '../../../supabase/functions/_shared/cms/schemas/home';
import { interpolate } from '../../../supabase/functions/_shared/cms/placeholders';

type SeoCopy = HomeContent['seo'];
type CardKey = keyof SeoCopy['cards'];

interface CardDef {
  href: string;
  titleKey: CardKey;
  descKey: CardKey;
  icon: string;
}

const PRIMARY_CARDS: CardDef[] = [
  { href: '/eurovision-night', titleKey: 'nightTitle', descKey: 'nightDesc', icon: '🎤' },
  { href: '/eurovision-predictions', titleKey: 'predictionsTitle', descKey: 'predictionsDesc', icon: '🎯' },
  { href: '/eurovision-trivia', titleKey: 'triviaTitle', descKey: 'triviaDesc', icon: '🧠' },
];

const SECONDARY_CARDS: CardDef[] = [
  { href: '/eurovision-party', titleKey: 'partyTitle', descKey: 'partyDesc', icon: '🎉' },
  { href: '/eurovision-games', titleKey: 'gamesTitle', descKey: 'gamesDesc', icon: '🕹️' },
  { href: '/how-to-play', titleKey: 'howTitle', descKey: 'howDesc', icon: '📘' },
];

function Card({ card, cards }: { card: CardDef; cards: SeoCopy['cards'] }) {
  return (
    <LocaleLink
      to={card.href}
      className="group relative rounded-xl border border-white/10 bg-white/[0.02] hover:border-euro-pink/50 hover:bg-white/[0.05] transition-all duration-200 p-5 block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" aria-hidden>{card.icon}</span>
          <h3 className="font-bold text-white group-hover:text-euro-pink-light transition">
            {cards[card.titleKey]}
          </h3>
        </div>
        <svg
          className="w-4 h-4 text-white/30 group-hover:text-euro-pink-light group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 mt-1"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          aria-hidden
        >
          <path d="M7 17L17 7M17 7H8M17 7v9" />
        </svg>
      </div>
      <p className="mt-2 text-sm text-white/65 leading-relaxed">
        {cards[card.descKey]}
      </p>
    </LocaleLink>
  );
}

// SEO + GEO content block on the homepage. Mirrors the polished kit pattern
// used across all SEO supporting pages: H1 + lede + sectioned content,
// kit-style "Keep reading" cards, soft secondary CTA. The text is the home
// page's CMS doc (content/pages/home.json, `seo`), passed in by HomePage.
export default function HomeSeoBlock({ copy: c }: { copy: SeoCopy }) {
  const year = useCurrentYear();

  return (
    <section className="bg-euro-deep text-white border-t border-white/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-12 lg:space-y-16">
        {/* Headline + lede */}
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white">
            {c.headline}
          </h1>
          <p className="mt-5 text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
            <strong className="text-white">{c.leadStrong}</strong>
            {interpolate(c.leadRest, { year })}
          </p>
        </header>

        {/* Primary cards — 3 across the most important destinations */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5">
            {c.primaryHeading}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PRIMARY_CARDS.map((card) => <Card key={card.href} card={card} cards={c.cards} />)}
          </div>
        </div>

        {/* Secondary cards — 3 across deeper pages */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5">
            {c.secondaryHeading}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SECONDARY_CARDS.map((card) => <Card key={card.href} card={card} cards={c.cards} />)}
          </div>
        </div>

        {/* Soft CTA — points to the most-used informational page */}
        <p className="text-center text-sm text-white/55">
          {c.tail}{' '}
          <LocaleLink to="/how-to-play" className="text-euro-pink-light hover:text-white underline underline-offset-2">
            {c.tailLink}
          </LocaleLink>
          .
        </p>
      </div>
    </section>
  );
}
