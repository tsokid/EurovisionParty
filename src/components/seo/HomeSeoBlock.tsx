import { useTranslation } from 'react-i18next';
import LocaleLink from './LocaleLink';

interface CardDef {
  href: string;
  titleKey: string;
  descKey: string;
  icon: string;
}

const PRIMARY_CARDS: CardDef[] = [
  { href: '/eurovision-night', titleKey: 'nightTitle', descKey: 'nightDesc', icon: '🎤' },
  { href: '/eurovision-2026-predictions', titleKey: 'predictionsTitle', descKey: 'predictionsDesc', icon: '🎯' },
  { href: '/eurovision-trivia', titleKey: 'triviaTitle', descKey: 'triviaDesc', icon: '🧠' },
];

const SECONDARY_CARDS: CardDef[] = [
  { href: '/eurovision-party', titleKey: 'partyTitle', descKey: 'partyDesc', icon: '🎉' },
  { href: '/eurovision-games', titleKey: 'gamesTitle', descKey: 'gamesDesc', icon: '🕹️' },
  { href: '/how-to-play', titleKey: 'howTitle', descKey: 'howDesc', icon: '📘' },
];

function Card({ card, t }: { card: CardDef; t: (k: string) => string }) {
  return (
    <LocaleLink
      to={card.href}
      className="group relative rounded-xl border border-white/10 bg-white/[0.02] hover:border-euro-pink/50 hover:bg-white/[0.05] transition-all duration-200 p-5 block"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" aria-hidden>{card.icon}</span>
          <h3 className="font-bold text-white group-hover:text-euro-pink-light transition">
            {t(`homeSeo.cards.${card.titleKey}`)}
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
        {t(`homeSeo.cards.${card.descKey}`)}
      </p>
    </LocaleLink>
  );
}

// SEO + GEO content block on the homepage. Mirrors the polished kit pattern
// used across all SEO supporting pages: H1 + lede + sectioned content,
// kit-style "Keep reading" cards, soft secondary CTA.
export default function HomeSeoBlock() {
  const { t } = useTranslation();

  return (
    <section className="bg-euro-deep text-white border-t border-white/10">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 space-y-12 lg:space-y-16">
        {/* Headline + lede */}
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-white">
            {t('homeSeo.headline')}
          </h1>
          <p className="mt-5 text-lg text-white/75 max-w-2xl mx-auto leading-relaxed">
            <strong className="text-white">{t('homeSeo.leadStrong')}</strong>
            {t('homeSeo.leadRest')}
          </p>
        </header>

        {/* Primary cards — 3 across the most important destinations */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5">
            {t('homeSeo.primaryHeading', { defaultValue: 'Plan your Eurovision night' })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PRIMARY_CARDS.map((c) => <Card key={c.href} card={c} t={t} />)}
          </div>
        </div>

        {/* Secondary cards — 3 across deeper pages */}
        <div>
          <h2 className="text-xl font-bold text-white mb-5">
            {t('homeSeo.secondaryHeading', { defaultValue: 'Get to know the game' })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SECONDARY_CARDS.map((c) => <Card key={c.href} card={c} t={t} />)}
          </div>
        </div>

        {/* Soft CTA — points to the most-used informational page */}
        <p className="text-center text-sm text-white/55">
          {t('homeSeo.tail', { defaultValue: 'New here?' })}{' '}
          <LocaleLink to="/how-to-play" className="text-euro-pink-light hover:text-white underline underline-offset-2">
            {t('homeSeo.tailLink', { defaultValue: 'Read the 60-second setup guide' })}
          </LocaleLink>
          .
        </p>
      </div>
    </section>
  );
}
